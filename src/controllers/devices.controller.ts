import type { Request, Response, NextFunction } from "express";

import {
  createOrUpdateDevice,
  deleteDevice,
  getDevices,
  updateDevice,
} from "../services/device.service.js";

import type {
  CreateDeviceInput,
  UpdateDeviceInput,
} from "../schemas/device.schema.js";

export async function createDeviceController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new Error("Authenticated user context is missing");
    }

    const input = req.body as CreateDeviceInput;

    const device = await createOrUpdateDevice(req.user.userId, input);

    res.status(200).json({
      success: true,
      message: "Device registered successfully",
      data: {
        device,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getDevicesController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new Error("Authenticated user context is missing");
    }

    const devices = await getDevices(req.user.userId);

    res.status(200).json({
      success: true,
      data: {
        devices,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateDeviceController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new Error("Authenticated user context is missing");
    }

    const input = req.body as UpdateDeviceInput;

    const device = await updateDevice(
      req.user.userId,
      req.params.id as string,
      input,
    );

    res.status(200).json({
      success: true,
      message: "Device updated successfully",
      data: {
        device,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteDeviceController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new Error("Authenticated user context is missing");
    }

    await deleteDevice(req.user.userId, req.params.id as string);

    res.status(200).json({
      success: true,
      message: "Device deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}
