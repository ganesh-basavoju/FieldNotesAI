import mongoose, { Schema, Document } from "mongoose";

export interface IEvidenceLink extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  taskId: mongoose.Types.ObjectId;
  targetType: string;
  targetId: string;
  linkType: string;
  linkScore: number;
  createdBy: string;
  createdAt: Date;
}

const EvidenceLinkSchema = new Schema<IEvidenceLink>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    targetType: { type: String, required: true, enum: ["media", "audio", "transcript"] },
    targetId: { type: String, required: true },
    linkType: { type: String, default: "suggested", enum: ["strong", "suggested", "possible"] },
    linkScore: { type: Number, default: 0.5 },
    createdBy: { type: String, default: "user", enum: ["system", "user"] },
  },
  { timestamps: true }
);

EvidenceLinkSchema.set("toJSON", {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

export const EvidenceLink = mongoose.model<IEvidenceLink>("EvidenceLink", EvidenceLinkSchema);
