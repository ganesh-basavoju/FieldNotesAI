import mongoose, { Schema, Document } from "mongoose";

export interface IArea extends Document {
  _id: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: string;
  label: string;
  createdAt: Date;
}

const AreaSchema = new Schema<IArea>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, required: true },
    label: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

AreaSchema.set("toJSON", {
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

export const Area = mongoose.model<IArea>("Area", AreaSchema);
