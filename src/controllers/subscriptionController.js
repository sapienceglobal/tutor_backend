import SubscriptionPlan from '../models/SubscriptionPlan.js';

// @desc    Get all subscription plans
// @route   GET /api/subscriptions
// @access  Public (or Superadmin, depending on your needs. Usually public for pricing pages)
export const getPlans = async (req, res) => {
    try {
        const plans = await SubscriptionPlan.find().sort({ price: 1 });
        res.status(200).json({ success: true, plans });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create a new subscription plan
// @route   POST /api/subscriptions
// @access  Superadmin
export const createPlan = async (req, res) => {
    try {
        const newPlan = new SubscriptionPlan(req.body);
        await newPlan.save();
        res.status(201).json({ success: true, plan: newPlan, message: 'Plan created successfully' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Update a subscription plan
// @route   PUT /api/subscriptions/:id
// @access  Superadmin
export const updatePlan = async (req, res) => {
    try {
        const plan = await SubscriptionPlan.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
        res.status(200).json({ success: true, plan, message: 'Plan updated successfully' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Delete a subscription plan
// @route   DELETE /api/subscriptions/:id
// @access  Superadmin
export const deletePlan = async (req, res) => {
    try {
        // NOTE: In a real app, check if institutes are currently using this plan before deleting!
        // Alternatively, just set isActive = false.
        const plan = await SubscriptionPlan.findByIdAndDelete(req.params.id);
        if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
        res.status(200).json({ success: true, message: 'Plan deleted permanently' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};