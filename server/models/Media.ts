import mongoose, { Schema, Document } from "mongoose";

export interface IMedia extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  areaId: mongoose.Types.ObjectId;
  areaType: string;
  type: string;
  s3Key: string;
  thumbnailS3Key?: string;
  originalFilename?: string;
  mimeType?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  capturedAt: Date;
  syncStatus: string;
  sessionId?: mongoose.Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const MediaSchema = new Schema<IMedia>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    areaId: { type: Schema.Types.ObjectId, ref: "Area", required: true },
    areaType: { type: String, required: true },
    type: { type: String, required: true, enum: ["photo", "video"] },
    s3Key: { type: String, required: true },
    thumbnailS3Key: { type: String },
    originalFilename: { type: String },
    mimeType: { type: String },
    fileSize: { type: Number },
    width: { type: Number },
    height: { type: Number },
    capturedAt: { type: Date, required: true },
    syncStatus: { type: String, default: "captured", enum: ["captured", "syncing", "uploaded", "failed"] },
    sessionId: { type: Schema.Types.ObjectId, ref: "Session" },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

MediaSchema.set("toJSON", {
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

export const Media = mongoose.model<IMedia>("Media", MediaSchema);
