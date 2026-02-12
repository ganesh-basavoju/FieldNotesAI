import mongoose, { Schema, Document } from "mongoose";

export interface ITask extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  areaId?: mongoose.Types.ObjectId;
  areaType?: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  dueDate?: Date;
  tags: string[];
  createdBy: string;
  confidence?: number;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    areaId: { type: Schema.Types.ObjectId, ref: "Area" },
    areaType: { type: String },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    status: { type: String, default: "open", enum: ["open", "in_progress", "blocked", "done"] },
    priority: { type: String, default: "medium", enum: ["low", "medium", "high"] },
    dueDate: { type: Date },
    tags: [{ type: String }],
    createdBy: { type: String, default: "user", enum: ["system", "user"] },
    confidence: { type: Number },
  },
  { timestamps: true }
);

TaskSchema.set("toJSON", {
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

export const Task = mongoose.model<ITask>("Task", TaskSchema);
