import mongoose, { Document, Schema, Types } from 'mongoose';
import validator from 'validator';
import argon2 from 'argon2';

export interface IUser extends Document<Types.ObjectId> {
    name: string;
    email: string;
    password: string;
    role: 'admin' | 'user';
    isEmailVerified: boolean;
    twoFactorSecret?: string;
    twoFactorEnabled: boolean;
    createdAt: Date;
    updatedAt: Date;
    comparePassword(candidatePassword: string): Promise<boolean>;
};

const userSchema = new Schema<IUser>(
    {
        name: {type: String, required: [true, "Name is required"]},
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true, 
            lowercase: true, 
            validate: [validator.isEmail, 'Please provide a valid email'],
        },
        password: {type: String, required: [true, "Password is required"], minlength: 8, select: false},
        role: {type: String, enum: ['admin', 'user'], default: 'user'},
        isEmailVerified: {type: Boolean, default: false},
        twoFactorEnabled: {type: Boolean, default: false},
        twoFactorSecret: {type: String, select: false}
    }, 
    {timestamps: true}
);

// Password hashing middleware
// userSchema.pre<IUser>('save', async function(next){
//     if(!this.isModified('password')) return next();
//     this.password = await argon2.hash(this.password);
//     next();
// });


userSchema.pre<IUser>('save', async function(next){
    if(!this.isModified('password')) return next();
    
    // Check if password is already hashed (Argon2 hashes start with $argon2)
    if (this.password.startsWith('$argon2')) {
        return next();
    }
    
    this.password = await argon2.hash(this.password);
    next();
});



//Method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean>{
    return await argon2.verify(this.password, candidatePassword);
}

export const User = mongoose.model<IUser>('User', userSchema);


