import { Document, Schema } from "mongoose";
import { IUser } from "./user.models";
import mongoose from "mongoose";


export interface ICategory extends Document {
    name: string;
    icon: string;
    color: string;
    type: 'income' | 'expense';
    user: IUser;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date
}


const categorySchema = new Schema<ICategory>(
    {
        name: { type: String, required: [true, 'Category name is required'] },
    icon: { type: String, required: [true, 'Icon is required'] },
    color: { type: String, required: [true, 'Color is required'] },
    type: {
        type: String, enum: ['expense', 'income'], required: [true, "Type is required"]
    }, 
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: function() {return !this.isDefault; }
    },
    isDefault: {type: Boolean, default: false}
    },
    {timestamps: true}
);

categorySchema.index({user: 1, type: 1});
export const Category = mongoose.model<ICategory>("Category", categorySchema);




