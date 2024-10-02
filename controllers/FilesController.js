import mime from 'mime-types';
import path from 'path';
import mongoDBCore from 'mongodb/lib/core';
import Queue from 'bull/lib/queue';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { tmpdir } from 'os';
import dbClient from '../utils/db';
import { fromToken } from '../utils/auth';

const fileQueue = new Queue('thumbnail generation');
const convert = (id) => {
  const notId = Buffer.alloc(24, '0').toString('utf-8');
  if (id === 0 || id.toString() === '0') {
    return 0;
  }
  try {
    const ru = new mongoDBCore.BSON.ObjectId(id);
    return ru;
  } catch (error) {
    const err = new mongoDBCore.BSON.ObjectId(notId);
    return err;
  }
};

const FilesController = {
  async postUpload(req, res) {
    const { user } = req;
    const name = req.body ? req.body.name : null;
    const type = req.body ? req.body.type : 'none';
    const parentId = req.body && req.body.parentId ? req.body.parentId : 0;
    const isPublic = req.body && req.body.isPublic ? req.body.isPublic : false;
    const data = req.body ? req.body.data : '';
    const fTypes = ['folder', 'file', 'image'];
    const root = `${process.env.FOLDER_PATH || ''}`.trim().length > 0
      ? process.env.FOLDER_PATH.trim()
      : path.join(tmpdir(), 'files_manager');
    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }
    if (!fTypes.includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }

    if (!req.body.data && type !== 'folder') {
      return res.status(400).json({ error: 'Missing data' });
    }

    let pId = 0;
    if (parentId && parentId !== 0 && parentId !== pId.toString()) {
      pId = convert(parentId);
      const par = await (await dbClient.files()).findOne({ _id: pId });
      if (!par) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (par.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }
    const doc = {
      name,
      type,
      parentId: pId,
      userId: user._id,
      isPublic,
    };
    if (type === 'folder') {
      const result = await (await dbClient.files()).insertOne(doc);
      return res.status(201).json({
        name,
        type,
        parentId: pId.toString(),
        id: result.insertedId.toString(),
        userId: user._id.toString(),
        isPublic,
      });
    }
    if (!fs.existsSync(root)) {
      fs.mkdirSync(root, { recursive: true });
    }
    const filename = uuidv4();
    const filePath = path.join(root, filename);

    const decoded = Buffer.from(data, 'base64');
    await fs.promises.writeFile(filePath, decoded);
    doc.localPath = filePath;
    const result = await (await dbClient.files()).insertOne(doc);
    if (type === 'image') {
      const userId = user._id.toString();
      const fileId = result.insertedId.toString();
      const jobName = `Image thumbnail [${userId}-${fileId}]`;
      fileQueue.add({ userId, fileId, name: jobName });
    }
    return res.status(201).json({
      name,
      type,
      parentId: pId.toString(),
      id: result.insertedId.toString(),
      userId: user._id.toString(),
      isPublic,
    });
  },
  async getShow(req, res) {
    const { user } = req;
    const fileId = req.params.id;
    const file = await (await dbClient.files()).findOne({
      _id: convert(fileId),
      userId: user._id,
    });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.json({
      id: file._id.toString(),
      userId: file.userId.toString(),
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId.toString(),
    });
  },
  async putPublish(req, res) {
    const { user } = req;
    const fileId = req.params.id;
    const filter = {
      _id: convert(fileId),
      userId: user._id,
    };
    const file = await (await dbClient.files()).findOne(filter);

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }
    await (await dbClient.files())
      .updateOne(filter, { $set: { isPublic: true } });
    return res.json({
      id: file._id.toString(),
      userId: file.userId.toString(),
      name: file.name,
      type: file.type,
      isPublic: true,
      parentId: file.parentId.toString(),
    });
  },

  async putUnpublish(req, res) {
    const { user } = req;
    const fileId = req.params.id;
    const filter = {
      _id: convert(fileId),
      userId: user._id,
    };
    const file = await (await dbClient.files()).findOne(filter);
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    await (await dbClient.files())
      .updateOne(filter, { $set: { isPublic: false } });
    return res.json({
      id: file._id.toString(),
      userId: file.userId.toString(),
      name: file.name,
      type: file.type,
      isPublic: false,
      parentId: file.parentId.toString(),
    });
  },

  async getIndex(req, res) {
    const { user } = req;
    const pId = req.query.parentId || 0;
    const pageSize = 20;
    const page = parseInt(req.query.page, 10) || 0;
    const pipe = [
      {
        $match: {
          userId: user._id,
          parentId: convert(pId),
        },
      },
      { $sort: { _id: -1 } },
      {
        $skip: page * pageSize,
      },
      {
        $limit: pageSize,
      },
      {
        $project: {
          _id: 0,
          id: '$_id',
          userId: '$userId',
          name: '$name',
          type: '$type',
          isPublic: '$isPublic',
          parentId: '$parentId',
        },
      },
    ];
    const docs = await (await dbClient.files()).aggregate(pipe).toArray();

    return res.json(docs);
  },
  async getFile(req, res) {
    const user = await fromToken(req);
    const fileId = req.params.id;
    const size = req.query.size || null;
    const filter = {
      _id: convert(fileId),
      userId: user._id,
    };
    const file = await (await dbClient.files()).findOne(filter);
    if (!file || !file.isPublic) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (file.type === 'folder') {
      return res.status(400).json({ error: "A folder doesn't have content" });
    }
    let filePath = file.localPath;
    if (size) {
      filePath = `${file.localPath}_${size}`;
    }
    if (fs.existsSync(filePath)) {
      const fInfo = await fs.promises.stat(filePath);
      if (!fInfo.isFile()) {
        return res.status(404).json({ error: 'Not found' });
      }
    } else {
      return res.status(404).json({ error: 'Not found' });
    }
    const absFile = await fs.promises.realpath(filePath);
    // console.log(file.name, file.type);
    const type = mime.contentType(file.name) || 'text/plain; charset=utf-8';
    // console.log(type);
    res.setHeader('Content-Type', type);
    return res.status(200).sendFile(absFile);
  },
};
export default FilesController;
