import Channel from '../models/Channel.js';
import Server from '../models/Server.js';

// Get a user's role in a server
export const getUserRole = async (userId, serverId) => {
  const server = await Server.findById(serverId);
  if (!server) return null;
  const member = server.members.find(m => m.user.equals(userId));
  return member?.role || null;
};

// Check if a user has a specific permission in a channel
export const checkChannelPermission = async (userId, channelId, permission) => {
  const channel = await Channel.findById(channelId);
  if (!channel) return false;

  const role = await getUserRole(userId, channel.server);
  if (!role) return false; // not a member

  // Owners always have everything
  if (role === 'owner') return true;

  const perms = channel.getPermissionsForRole(role);
  return perms[permission] === true;
};

// Express middleware factory
export const requireChannelPermission = (permission) => async (req, res, next) => {
  const channelId = req.params.channelId || req.body.channelId;
  if (!channelId) return res.status(400).json({ error: 'Channel ID required' });

  const allowed = await checkChannelPermission(req.user._id, channelId, permission);
  if (!allowed) return res.status(403).json({ error: `Missing permission: ${permission}` });
  next();
};

// Get all effective permissions for a user in a channel (used by frontend)
export const resolveUserPermissions = async (userId, channelId) => {
  const channel = await Channel.findById(channelId);
  if (!channel) return null;

  const role = await getUserRole(userId, channel.server);
  if (!role) return null;

  if (role === 'owner') {
    return {
      viewChannel: true, sendMessages: true, addReactions: true,
      attachFiles: true, readHistory: true, manageMessages: true, manageChannel: true,
    };
  }

  return channel.getPermissionsForRole(role);
};
