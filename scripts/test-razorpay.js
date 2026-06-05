import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Razorpay from 'razorpay';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://Adarsh:adarsh2424@cluster0.3ynbxui.mongodb.net/tutorManagementDb';

let razorpay = null;
const getRazorpay = () => {
    if (!razorpay) {
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            throw new Error('Razorpay keys not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env');
        }
        razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });
    }
    return razorpay;
};

async function test() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');
        console.log('RAZORPAY_KEY_ID:', process.env.RAZORPAY_KEY_ID);
        
        // Find a created/failed payment
        const payment = await mongoose.connection.db.collection('payments').findOne({ status: 'created' });
        if (!payment) {
            console.log('No pending payment found to test');
            process.exit(0);
        }
        
        console.log('Testing with payment:', payment._id, 'Amount:', payment.amount);
        
        const amountInPaise = Math.round(payment.amount * 100);
        const order = await getRazorpay().orders.create({
            amount: amountInPaise,
            currency: payment.currency || 'INR',
            receipt: `retry_${payment._id.toString().slice(-12)}_${Date.now()}`,
            notes: {
                originalPaymentId: payment._id.toString(),
                retryCount: (payment.retryCount || 0) + 1,
            },
        });
        
        console.log('Razorpay Order created successfully:', order);
        process.exit(0);
    } catch (err) {
        console.error('Error during test:', err);
        process.exit(1);
    }
}

test();
