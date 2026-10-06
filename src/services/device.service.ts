
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";
import type {
  CreateDeviceInput,
  UpdateDeviceInput,
} from "../schemas/device.schema.js";

const deviceSelect = {
  id: true,
  deviceId: true,
  pushToken: true,
  platform: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function createOrUpdateDevice(
  userId: string,
  input: CreateDeviceInput,
) {
  const { deviceId, pushToken, platform } = input;

  const device = await prisma.device.upsert({
    where: {
      userId_deviceId: {
        userId,
        deviceId,
      },
    },
    create: {
      userId,
      deviceId,
      pushToken,
      platform,
    },
    update: {
      pushToken,
      platform,
      updatedAt: new Date(),
    },
    select: deviceSelect,
  });

  return device;
}

export async function getDevices(userId: string) {
  return prisma.device.findMany({
    where: {
      userId,
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: deviceSelect,
  });
}

export async function updateDevice(
  userId: string,
  deviceId: string,
  input: UpdateDeviceInput,
) {
  const result = await prisma.device.updateMany({
    where: {
      id: deviceId,
      userId,
    },
    data: {
      ...(input.pushToken !== undefined && {
        pushToken: input.pushToken,
      }),
      ...(input.platform !== undefined && {
        platform: input.platform,
      }),
      updatedAt: new Date(),
    },
  });

  if (result.count === 0) {
    throw new AppError(
      "Device not found",
      404,
      "DEVICE_NOT_FOUND",
    );
  }

  return prisma.device.findFirst({
    where: {
      id: deviceId,
      userId,
    },
    select: deviceSelect,
  });
}

export async function deleteDevice(
  userId: string,
  deviceId: string,
) {
  const result = await prisma.device.deleteMany({
    where: {
      id: deviceId,
      userId,
    },
  });

  if (result.count === 0) {
    throw new AppError(
      "Device not found",
      404,
      "DEVICE_NOT_FOUND",
    );
  }
}