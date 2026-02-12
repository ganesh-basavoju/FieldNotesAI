import mongoose, { Schema, Document } from "mongoose";

export interface ISession extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  areaId: mongoose.Types.ObjectId;
  areaType: string;
  mode: string;
  startedAt: Date;
  endedAt?: Date;
  mediaIds: string[];
  audioIds: string[];
  webhookStatus: string;
  webhookResult?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    areaId: { type: Schema.Types.ObjectId, ref: "Area", required: true },
    areaType: { type: String, required: true },
    mode: { type: String, required: true, enum: ["photo_speak", "walkthrough", "voice_only"] },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date },
    mediaIds: [{ type: String }],
    audioIds: [{ type: String }],
    webhookStatus: { type: String, default: "pending", enum: ["pending", "sent", "received", "failed"] },
    webhookResult: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

SessionSchema.set("toJSON", {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

export const Session = mongoose.model<ISession>("Session", SessionSchema);
