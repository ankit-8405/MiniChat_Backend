const Call = require('../models/Call');

exports.getCallHistory = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { channelId } = req.query;

    const query = {
      $or: [
        { caller: userId },
        { receiver: userId }
      ]
    };

    if (channelId) {
      query.channelId = channelId;
    }

    const calls = await Call.find(query)
      .populate('caller', 'username avatar')
      .populate('receiver', 'username avatar')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ calls });
  } catch (error) {
    next(error);
  }
};

exports.getCallById = async (req, res, next) => {
  try {
    const { callId } = req.params;
    const userId = req.userId;

    const call = await Call.findById(callId)
      .populate('caller', 'username avatar')
      .populate('receiver', 'username avatar');

    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    // Check if user is part of the call
    if (call.caller._id.toString() !== userId && call.receiver._id.toString() !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({ call });
  } catch (error) {
    next(error);
  }
};

exports.createCall = async (req, res, next) => {
  try {
    const { receiverId, callType, channelId } = req.body;
    const userId = req.userId;

    if (userId === receiverId) {
      return res.status(400).json({ error: 'Cannot call yourself' });
    }

    const call = new Call({
      caller: userId,
      receiver: receiverId,
      callType,
      channelId,
      status: 'initiated'
    });

    await call.save();
    await call.populate('caller', 'username avatar');
    await call.populate('receiver', 'username avatar');

    res.status(201).json({ call });
  } catch (error) {
    next(error);
  }
};

exports.updateCallStatus = async (req, res, next) => {
  try {
    const { callId } = req.params;
    const { status, endedBy } = req.body;
    const userId = req.userId;

    const call = await Call.findById(callId);

    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    call.status = status;

    if (status === 'accepted' && !call.startTime) {
      call.startTime = new Date();
    }

    if (status === 'ended' || status === 'rejected') {
      call.endTime = new Date();
      call.endedBy = endedBy || userId;
    }

    await call.save();

    res.json({ call });
  } catch (error) {
    next(error);
  }
};
