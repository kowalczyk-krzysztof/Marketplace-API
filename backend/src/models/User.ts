import mongoose, { ObjectId } from 'mongoose';
import bcryptjs from 'bcryptjs';
import jsonwebtoken from 'jsonwebtoken';
import crypto from 'crypto';
import { ErrorResponse } from '../utils/ErrorResponse';
import Product from './Product';

interface User extends mongoose.Document {
  name: string;
  email: string;
  verifiedEmail: string;
  photo: string;
  role: string;
  password: string;
  addedProducts: mongoose.Types.Array<ObjectId>;
  verifyEmailToken: string | undefined | number;
  verifyEmailTokenExpire: string | undefined | number;
  resetPasswordToken: string | undefined;
  resetPasswordExpire: number | undefined;
  createdAt: Date;
  getSignedJwtToken(): string;
  matchPassword(enteredPassword: string): string;
  getResetPasswordToken(): string;
  roleCheck(...roles: string[]): void;
}

// Interface UserModel is needed for static methods to work with TypeScript, instance methods go into UserModel
interface UserModel extends mongoose.Model<User> {
  userExists(id: string): Promise<User>;
  getVerifyEmailToken(): (string | number)[];
}

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a name'],
      minlength: [4, 'Name needs to be at least 4 characters'],
      maxlenght: [20, 'Name can not be more than 20 characters'],
    },

    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please add a valid email',
      ],
    },
    verifiedEmail: {
      type: String,
      enum: ['VERIFIED', 'NOT VERIFIED'],
      default: 'NOT VERIFIED',
    },
    photo: {
      type: String,
      default: 'no_photo.jpg',
    },
    role: {
      type: String,
      enum: {
        values: ['USER', 'MERCHANT', 'ADMIN'],
        message: 'Valid roles are: USER and MERCHANT',
        default: 'USER',
      },
    },
    password: {
      type: String,
      required: [true, 'Please add a password'],
      match: [
        /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/,
        'Password needs to be at least 8 characters and contain one uppercase and lowercase letter, one digit and at least one special character',
      ], // {8,} is the password length

      select: false, // makes it so when getting the password from db, we won't see it
    },
    addedProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    verifyEmailToken: String,
    verifyEmailTokenExpire: Date,
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    createdAt: { type: Date, immutable: true },
  },
  { timestamps: true } // this has to be passed to constructor, so after the object with all properties
);

// Encrypt password using bcrypt
UserSchema.pre<User>('save', async function (next): Promise<void> {
  // Without this check, user password would get hashed again  with different salt on every save which would break the password. So with this check, the password only gets hashed if modified so when CREATING the user or MODYFING password
  if (!this.isModified('password')) {
    next();
  }
  let user: User = this;
  const salt: string = await bcryptjs.genSalt(10);
  user.password = await bcryptjs.hash(user.password, salt);
});
// Deletes all products created by user - this has to be a pre hook or it will only delete one product
UserSchema.pre<User>(
  'deleteOne',
  { document: true, query: false },
  async function () {
    const products: Product[] = await Product.find({
      addedById: this.id,
    });

    for (const product of products) {
      await product.deleteOne();
    }
  }
);

// Sign JWT and return
UserSchema.methods.getSignedJwtToken = function (): string {
  return jsonwebtoken.sign({ id: this.id }, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function (
  enteredPassword: string
): Promise<boolean> {
  let user: User = this as User;
  return await bcryptjs.compare(enteredPassword, user.password);
};

// Generate and hash password reset token
UserSchema.methods.getResetPasswordToken = function (): string {
  // Generate token
  const resetToken: string = crypto.randomBytes(20).toString('hex');

  // Hash token and set to resetPasswordToken field
  let user: User = this as User; // need to do this otherwise error: Property 'resetPasswordToken' does not exist on type 'Document<any>'

  user.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set expire
  user.resetPasswordExpire = Date.now() + 1 * 24 * 60 * 60 * 1000; // 1 day

  return resetToken; // original token
};

// Generate and hash email verification token
UserSchema.statics.getVerifyEmailToken = function (): (string | number)[] {
  // Generate token
  const verifyToken: string = crypto.randomBytes(20).toString('hex');

  // Hash token
  const verifiyTokenHashed: string = crypto
    .createHash('sha256')
    .update(verifyToken)
    .digest('hex');

  // Set expire
  const verifyTokenExpire = Date.now() + 1 * 24 * 60 * 60 * 1000; // 1 day

  const tokenData: (string | number)[] = [
    verifyToken,
    verifiyTokenHashed,
    verifyTokenExpire,
  ];

  return tokenData;
};

// Checks if user exists
UserSchema.statics.userExists = async function (id: ObjectId) {
  let user: User | null = await User.findOne({ _id: id });
  if (!user)
    throw new ErrorResponse(`User with id of ${id} does not exist`, 404);
  return user;
};

// Role check
UserSchema.methods.roleCheck = function (...roles) {
  const allowedRoles: string[] = roles;
  const user = this as User;
  if (!allowedRoles.includes(user.role))
    throw new ErrorResponse(
      `User with role of ${user.role} is unauthorized to access this route`,
      403
    );
};

// Exporting the model with an interface applied
const User: UserModel = mongoose.model<User, UserModel>('User', UserSchema);
export default User;
