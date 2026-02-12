import mongoose, { Schema, Document } from "mongoose";

export interface IAudioNote extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  areaId: mongoose.Types.ObjectId;
  areaType: string;
  s3Key: string;
  originalFilename?: string;
  mimeType?: string;
  fileSize?: number;
  durationMs: number;
  capturedAt: Date;
  syncStatus: string;
  sessionId?: mongoose.Types.ObjectId;
  linkedMediaId?: mongoose.Types.ObjectId;
  transcript?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AudioNoteSchema = new Schema<IAudioNote>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    areaId: { type: Schema.Types.ObjectId, ref: "Area", required: true },
    areaType: { type: String, required: true },
    s3Key: { type: String, required: true },
    originalFilename: { type: String },
    mimeType: { type: String },
    fileSize: { type: Number },
    durationMs: { type: Number, required: true },
    capturedAt: { type: Date, required: true },
    syncStatus: { type: String, default: "captured", enum: ["captured", "syncing", "uploaded", "failed"] },
    sessionId: { type: Schema.Types.ObjectId, ref: "Session" },
    linkedMediaId: { type: Schema.Types.ObjectId, ref: "Media" },
    transcript: { type: String },
  },
  { timestamps: true }
);

AudioNoteSchema.set("toJSON", {
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

export const AudioNote = mongoose.model<IAudioNote>("AudioNote", AudioNoteSchema);
