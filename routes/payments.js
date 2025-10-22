const express = require('express');
const { body, validationResult } = require('express-validator');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');

const router = express.Router();

// @route   POST /api/payments/create-payment-intent
// @desc    Create a payment intent for subscription
// @access  Private
router.post('/create-payment-intent', [
  body('subscriptionType').isIn(['premium', 'pro']).withMessage('Invalid subscription type'),
  body('duration').isIn(['monthly', 'yearly']).withMessage('Invalid duration')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { subscriptionType, duration } = req.body;

    // Define pricing
    const prices = {
      premium: {
        monthly: 999, // $9.99 in cents
        yearly: 9999  // $99.99 in cents
      },
      pro: {
        monthly: 1999, // $19.99 in cents
        yearly: 19999  // $199.99 in cents
      }
    };

    const amount = prices[subscriptionType][duration];

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'usd',
      metadata: {
        userId: req.user._id.toString(),
        subscriptionType,
        duration
      }
    });

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        amount: amount
      }
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating payment intent'
    });
  }
});

// @route   POST /api/payments/confirm-payment
// @desc    Confirm payment and update user subscription
// @access  Private
router.post('/confirm-payment', [
  body('paymentIntentId').notEmpty().withMessage('Payment intent ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { paymentIntentId } = req.body;

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        message: 'Payment not completed'
      });
    }

    // Get subscription details from metadata
    const { subscriptionType, duration } = paymentIntent.metadata;

    // Calculate subscription end date
    const startDate = new Date();
    const endDate = new Date();
    
    if (duration === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    // Update user subscription
    const user = await User.findById(req.user._id);
    user.subscription = {
      type: subscriptionType,
      startDate: startDate,
      endDate: endDate,
      isActive: true
    };

    await user.save();

    res.json({
      success: true,
      message: 'Payment confirmed and subscription activated',
      data: {
        subscription: user.subscription
      }
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while confirming payment'
    });
  }
});

// @route   GET /api/payments/subscription-status
// @desc    Get user's subscription status
// @access  Private
router.get('/subscription-status', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    // Check if subscription is still active
    const now = new Date();
    const isActive = user.subscription.isActive && user.subscription.endDate > now;

    if (!isActive && user.subscription.isActive) {
      // Subscription expired, update status
      user.subscription.isActive = false;
      await user.save();
    }

    res.json({
      success: true,
      data: {
        subscription: user.subscription,
        isActive: isActive
      }
    });
  } catch (error) {
    console.error('Get subscription status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching subscription status'
    });
  }
});

// @route   POST /api/payments/cancel-subscription
// @desc    Cancel user's subscription
// @access  Private
router.post('/cancel-subscription', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user.subscription.isActive) {
      return res.status(400).json({
        success: false,
        message: 'No active subscription to cancel'
      });
    }

    // Cancel subscription (set end date to now)
    user.subscription.isActive = false;
    user.subscription.endDate = new Date();

    await user.save();

    res.json({
      success: true,
      message: 'Subscription cancelled successfully'
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while cancelling subscription'
    });
  }
});

// @route   GET /api/payments/pricing
// @desc    Get subscription pricing information
// @access  Public
router.get('/pricing', async (req, res) => {
  try {
    const pricing = {
      premium: {
        monthly: {
          price: 9.99,
          currency: 'USD',
          features: [
            'Access to premium games',
            'Priority customer support',
            'Exclusive tournaments',
            'Advanced statistics',
            'Custom avatars'
          ]
        },
        yearly: {
          price: 99.99,
          currency: 'USD',
          savings: '17%',
          features: [
            'Access to premium games',
            'Priority customer support',
            'Exclusive tournaments',
            'Advanced statistics',
            'Custom avatars',
            'Early access to new features'
          ]
        }
      },
      pro: {
        monthly: {
          price: 19.99,
          currency: 'USD',
          features: [
            'All premium features',
            'Unlimited tournaments',
            'Advanced analytics',
            'Custom guild features',
            'Priority matchmaking',
            'Exclusive content',
            '24/7 premium support'
          ]
        },
        yearly: {
          price: 199.99,
          currency: 'USD',
          savings: '17%',
          features: [
            'All premium features',
            'Unlimited tournaments',
            'Advanced analytics',
            'Custom guild features',
            'Priority matchmaking',
            'Exclusive content',
            '24/7 premium support',
            'Beta access to new games'
          ]
        }
      }
    };

    res.json({
      success: true,
      data: { pricing }
    });
  } catch (error) {
    console.error('Get pricing error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching pricing'
    });
  }
});

// @route   POST /api/payments/webhook
// @desc    Handle Stripe webhooks
// @access  Public
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('PaymentIntent succeeded:', paymentIntent.id);
      // Handle successful payment
      break;
    
    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      console.log('PaymentIntent failed:', failedPayment.id);
      // Handle failed payment
      break;
    
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

module.exports = router;
