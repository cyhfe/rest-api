import { Server as SocketServer } from "socket.io";
import prisma from "../db";
import { IncomingMessage, Server, ServerResponse } from "http";
interface User {
  username: string;
  id: string;
  avatar: string;
}

function createSocketServer(
  httpServer: Server<typeof IncomingMessage, typeof ServerResponse>
) {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const onlineList = new Set<User>();

  const chatSocket = io.of("/chat");

  chatSocket.on("connection", (socket) => {
    let channel: string | undefined;
    function updateOnlineList() {
      socket.emit("chat/updateOnlineList", Array.from(onlineList));
    }

    async function createChannel(channelName: string) {
      const existChannel = await prisma.channel.findUnique({
        where: {
          name: channelName,
        },
      });
      if (existChannel) {
        socket.emit("error", "该频道名已被使用");
        return;
      }
      await prisma.channel.create({
        data: {
          name: channelName,
          userId: user.id,
        },
      });
      updateChannels();
    }

    async function onDeleteChannel(channelId: string) {
      try {
        await prisma.channel.delete({
          where: {
            id: channelId,
          },
        });
      } catch (error) {
        socket.emit("error", "删除失败");
      }

      socket.emit("deleteChannel");
      updateChannels();
    }

    async function updateUsers() {
      const users = await prisma.user.findMany();
      socket.emit("chat/updateUsers", users);
    }

    async function updateChannels() {
      const channels = await prisma.channel.findMany();
      chatSocket.emit("chat/updateChannels", channels);
    }
    async function updatePrivateMessages(to: string) {
      const updatePrivateMessages = await prisma.privateMessage.findMany({
        where: {
          OR: [
            {
              fromUserId: user.id,
              toUserId: to,
            },
            {
              toUserId: user.id,
              fromUserId: to,
            },
          ],
        },
        include: {
          from: {
            select: {
              id: true,
              createdAt: true,
              username: true,
              avatar: true,
            },
          },
          to: {
            select: {
              id: true,
              createdAt: true,
              username: true,
              avatar: true,
            },
          },
        },
      });

      socket.emit("updatePrivateMessages", updatePrivateMessages);
    }

    async function onEnterChannel(channelId: string) {
      channel = channelId;
      await socket.join(channelId);
      const sockets = await chatSocket.in(channelId).fetchSockets();
      const users = sockets.map((socket) => {
        return socket.handshake.auth.user as User;
      });

      socket.broadcast.to(channelId).emit("chat/enterChannel", user);
      chatSocket.to(channelId).emit("chat/updateChannelUsers", users);

      const messages = await prisma.channelMessage.findMany({
        where: {
          toChannelId: channelId,
        },
        include: {
          from: {
            select: {
              id: true,
              createdAt: true,
              username: true,
              avatar: true,
            },
          },
        },
      });
      socket.emit("chat/updateChannelMessages", messages);
    }

    async function onLeaveChannel(channelId: string) {
      channel = void 0;
      await socket.leave(channelId);
      const sockets = await chatSocket.in(channelId).fetchSockets();

      const users = sockets.map((socket) => {
        return socket.handshake.auth.user as User;
      });

      socket.broadcast.to(channelId).emit("chat/leaveChannel", user);
      socket.broadcast.to(channelId).emit("chat/updateChannelUsers", users);
    }

    async function onGetChannel(channelId: string) {
      const channel = await prisma.channel.findUnique({
        where: {
          id: channelId,
        },
      });
      socket.emit("chat/getChannel", channel);
    }

    async function onChannelMessage({
      channelId,
      content,
    }: {
      channelId: string;
      content: string;
    }) {
      if (!content) {
        socket.emit("error", "内容不能为空");
        return;
      }
      const newMessage = await prisma.channelMessage.create({
        data: {
          fromUserId: user.id,
          toChannelId: channelId,
          content,
        },
      });

      const newMessageWithUser = await prisma.channelMessage.findUnique({
        where: {
          id: newMessage.id,
        },
        include: {
          from: {
            select: {
              id: true,
              createdAt: true,
              username: true,
              avatar: true,
            },
          },
        },
      });

      chatSocket
        .to(channelId)
        .emit("chat/updateChannelMessage", newMessageWithUser);
    }

    async function onPrivateMessage({
      content,
      to,
    }: {
      content: string;
      to: string;
    }) {
      if (!content) return;
      const newMessage = await prisma.privateMessage.create({
        data: {
          fromUserId: user.id,
          toUserId: to,
          content,
        },
      });

      const newMessageWithUser = await prisma.privateMessage.findUnique({
        where: {
          id: newMessage.id,
        },
        include: {
          from: {
            select: {
              id: true,
              createdAt: true,
              username: true,
              avatar: true,
            },
          },
          to: {
            select: {
              id: true,
              createdAt: true,
              username: true,
              avatar: true,
            },
          },
        },
      });

      chatSocket
        .to([to, user.id])
        .emit("chat/newPrivateMessage", newMessageWithUser);
    }

    async function onUpdateToUser(toUserId: string) {
      const user = await prisma.user.findUnique({
        where: {
          id: toUserId,
        },
        select: {
          id: true,
          createdAt: true,
          username: true,
          avatar: true,
        },
      });
      socket.emit("updateToUser", user);
    }

    const user = socket.handshake.auth.user as User;
    onlineList.add(user);
    socket.join(user.id);
    console.log(onlineList);
    chatSocket.emit("chat/updateOnlineList", Array.from(onlineList));

    socket.on("chat/updateOnlineList", updateOnlineList);
    socket.on("createChannel", createChannel);
    socket.on("deleteChannel", onDeleteChannel);
    socket.on("chat/updateUsers", updateUsers);
    socket.on("chat/updateChannels", updateChannels);
    socket.on("updatePrivateMessages", updatePrivateMessages);
    socket.on("updateToUser", onUpdateToUser);
    socket.on("chat/privateMessage", onPrivateMessage);
    socket.on("chat/enterChannel", onEnterChannel);
    socket.on("chat/leaveChannel", onLeaveChannel);
    socket.on("chat/getChannel", onGetChannel);
    socket.on("chat/channelMessage", onChannelMessage);

    socket.on("disconnect", () => {
      onlineList.delete(user);
      chatSocket.emit("chat/updateOnlineList", Array.from(onlineList));
      channel && onLeaveChannel(channel);
    });
  });

  const canvasSocket = io.of("/canvas");
  canvasSocket.on("connection", async (socket) => {
    const sockets = await canvasSocket.fetchSockets();
    const users = sockets.map((socket) => {
      return socket.handshake.auth.user as User;
    });
    canvasSocket.emit("updateUsers", users);

    socket.on("drawing", (data) => socket.broadcast.emit("drawing", data));
    socket.on("clear", () => socket.broadcast.emit("clear"));
    socket.on("changeStrokeColor", (data) =>
      socket.broadcast.emit("changeStrokeColor", data)
    );
    socket.on("disconnect", async () => {
      const sockets = await canvasSocket.fetchSockets();
      const users = sockets.map((socket) => {
        return socket.handshake.auth.user as User;
      });
      canvasSocket.emit("updateUsers", users);
    });
  });
}

export default createSocketServer;
