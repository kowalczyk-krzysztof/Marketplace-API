import { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongoose';
import Cart from '../models/Cart';
import Product from '../models/Product';
import User from '../models/User';
import { ErrorResponse } from '../utils/ErrorResponse';

// @desc    Get cart of logged in user
// @route   GET /api/v1/cart/mycart
// @access  Private
export const getMyCart = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // This is called REFERENCING documents - it queries for every single document, there's an another approach called EMBEDDED documents but I don't think it's a good approach for a cart

    // Check if cart exists for req.user
    const user: User = req.user as User;
    const cart: Cart = await Cart.cartExists(user.id);
    let cartStatus: Cart | string;
    let productCount: number = cart.products.length;

    if (productCount === 0) cartStatus = 'Your cart is empty';
    else
      cartStatus = await cart
        .populate(
          'products',
          'name pricePerUnit stock description addedBy photo'
        )
        .execPopulate();

    res.status(200).json({
      success: true,
      count: productCount,
      data: cartStatus,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add single product to cart
// @route   PUT /api/v1/cart/add/:id
// @access  Private
export const addProductToCart = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check if cart exists for req.user
    const user: User = req.user as User;
    const cart: Cart = await Cart.cartExists(user.id);

    // Check if product exists
    await Product.productExists(req.params.id);
    // Adds new product to cart, since it's addToSet, it will only add non duplicates
    cart.products.addToSet(req.params.id);
    cart.save();

    // Check if product is duplicate
    if (!cart.isModified('products'))
      res.status(400).json({
        success: false,
        data: `You already have product with id of ${req.params.id} in your cart`,
      });
    else
      res.status(201).json({
        success: true,
        data: `Added product with id of ${req.params.id} to your cart`,
      });
  } catch (err) {
    next(err);
  }
};

// @desc    Add many products to cart
// @route   PUT /api/v1/cart/add/
// @access  Private
export const addManyProductsToCart = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check if cart exists for req.user
    const user: User = req.user as User;
    const cart: Cart = await Cart.cartExists(user.id);

    // Adding products
    const productsToAdd: ObjectId[] = req.body.products;
    // Checking if products exist
    const productsExists = await Product.find({
      _id: { $in: productsToAdd },
    });
    const validProducts = [];

    for (const product of productsExists) {
      validProducts.push(product.id);
    }

    // Checks if products user is trying to add are both existing products and not already in cart
    const addedProducts: ObjectId[] = [];
    const notAdddedProducts: ObjectId[] = [];

    for (const product of productsToAdd) {
      if (validProducts.includes(product) && !cart.products.includes(product)) {
        cart.products.push(product);
        addedProducts.push(product);
      } else if (validProducts.includes(product))
        notAdddedProducts.push(product);
    }

    cart.save();

    // Message to be sent in res
    let message: string;
    if (addedProducts.length === 0)
      message = `No products were added. ${notAdddedProducts} are already in your cart.`;
    else if (notAdddedProducts.length > 0)
      message = `Added products: ${addedProducts}. ${notAdddedProducts} are already in your cart.`;
    else message = `Added products: ${addedProducts}`;

    res.status(200).json({
      success: true,
      data: message,
    });
  } catch (err) {
    next(err);
  }
};
// @desc    Delete single product from cart
// @route   PUT /api/v1/cart/mycart/delete/:id
// @access  Private
export const deleteProductFromCart = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check if cart exists for req.user
    const user: User = req.user as User;
    const cart = await Cart.cartExists(user.id);

    // Check if user is trying to delete a product that is not in his cart
    const product: string = req.params.id;
    if (!cart.products.includes(product))
      throw new ErrorResponse('Something went wrong', 400);

    // Removes products from cart
    cart.products.pull(product);
    cart.save();

    res.status(201).json({
      success: true,
      data: `Removed product with id of ${product} from your cart`,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete many products from cart
// @route   PUT /api/v1/cart/mycart/delete/
// @access  Private

export const deleteManyProductFromCart = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check if cart exists for req.user
    const user: User = req.user as User;
    const cart: Cart = await Cart.cartExists(user.id);

    //  .forEach expects a synchronous function and won't do anything with the return value. It just calls the function and on to the next. for...of will actually await on the result of the execution of the function.

    // Deleting products from cart
    const productsToDelete: ObjectId[] = req.body.products;
    const deletedProducts: ObjectId[] = [];

    // User shouldn't have non existent elements in his cart
    for (const product of productsToDelete) {
      if (cart.products.includes(product)) {
        cart.products.pull(product);
        deletedProducts.push(product);
      }
    }

    // Check if products exist in user's cart
    if (deletedProducts.length === 0)
      throw new ErrorResponse('Something went wrong', 400);

    cart.save();

    res.status(201).json({
      success: true,
      data: `Removed products: ${deletedProducts}`,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Empty cart
// @route   PUT /api/v1/cart/mycart/delete/:id
// @access  Private
export const emptyCart = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check if cart exists for req.user
    const user: User = req.user as User;
    const cart: Cart = await Cart.cartExists(user.id);
    if (cart.products.length === 0)
      throw new ErrorResponse(`Your cart is already empty`, 400);
    // Empties products array
    cart.products.splice(0, cart.products.length);
    cart.save();

    res.status(200).json({
      success: true,
      message: 'Your cart is now empty',
    });
  } catch (err) {
    next(err);
  }
};
