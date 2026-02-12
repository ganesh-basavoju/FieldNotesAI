import mongoose, { Schema, Document } from "mongoose";

export interface IProject extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  name: string;
  address: string;
  clientName: string;
  mediaCount: number;
  taskCount: number;
  openTaskCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    clientName: { type: String, required: true, trim: true },
    mediaCount: { type: Number, default: 0 },
    taskCount: { type: Number, default: 0 },
    openTaskCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ProjectSchema.set("toJSON", {
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

export const Project = mongoose.model<IProject>("Project", ProjectSchema);
