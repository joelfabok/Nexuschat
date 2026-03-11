import { create } from 'zustand';

// Tracks unread message counts for channels and DM conversations
export const useUnreadStore = create((set, get) => ({
  // { channelId: count }
  channels: {},
  // { conversationId: count }
  dms: {},

  markChannelUnread: (channelId) => set(state => ({
    channels: { ...state.channels, [channelId]: (state.channels[channelId] || 0) + 1 }
  })),

  markChannelRead: (channelId) => set(state => {
    const channels = { ...state.channels };
    delete channels[channelId];
    return { channels };
  }),

  markDMUnread: (conversationId) => set(state => ({
    dms: { ...state.dms, [conversationId]: (state.dms[conversationId] || 0) + 1 }
  })),

  markDMRead: (conversationId) => set(state => {
    const dms = { ...state.dms };
    delete dms[conversationId];
    return { dms };
  }),

  getChannelUnread: (channelId) => get().channels[channelId] || 0,
  getDMUnread: (conversationId) => get().dms[conversationId] || 0,
  totalDMUnread: () => Object.values(get().dms).reduce((a, b) => a + b, 0),
  totalChannelUnread: (serverChannelIds) =>
    serverChannelIds?.reduce((sum, id) => sum + (get().channels[id] || 0), 0) || 0,
}));
