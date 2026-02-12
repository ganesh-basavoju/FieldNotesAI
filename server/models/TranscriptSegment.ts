import mongoose, { Schema, Document } from "mongoose";

export interface ITranscriptSegment extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  audioNoteId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  text: string;
  startMs: number;
  endMs: number;
  speakerRole?: string;
  confidence: number;
  createdAt: Date;
}

const TranscriptSegmentSchema = new Schema<ITranscriptSegment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    audioNoteId: { type: Schema.Types.ObjectId, ref: "AudioNote", required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    text: { type: String, required: true },
    startMs: { type: Number, default: 0 },
    endMs: { type: Number, default: 0 },
    speakerRole: { type: String },
    confidence: { type: Number, default: 1 },
  },
  { timestamps: true }
);

TranscriptSegmentSchema.set("toJSON", {
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

export const TranscriptSegment = mongoose.model<ITranscriptSegment>("TranscriptSegment", TranscriptSegmentSchema);
