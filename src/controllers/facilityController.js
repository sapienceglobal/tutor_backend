import Facility from '../models/Facility.js';

// @desc    Get facilities for an institute
// @route   GET /api/facilities
// @access  Private
export const getFacilities = async (req, res) => {
    try {
        const instituteId = req.user.instituteId || req.query.instituteId;
        const query = instituteId ? { instituteId } : {};

        const facilities = await Facility.find(query).sort({ createdAt: -1 });

        res.status(200).json({ success: true, count: facilities.length, data: facilities });
    } catch (error) {
        console.error('Get facilities error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch facilities' });
    }
};

// @desc    Create a facility
// @route   POST /api/facilities
// @access  Private/Admin
export const createFacility = async (req, res) => {
    try {
        const { campusName, address, features, infrastructure, images, contactNumber, email, mapUrl } = req.body;

        if (!campusName) {
            return res.status(400).json({ success: false, message: 'Campus name is required' });
        }

        const facility = await Facility.create({
            instituteId: req.user.instituteId || req.body.instituteId,
            campusName,
            address: address || {},
            features: features || [],
            infrastructure: infrastructure || [],
            images: images || [],
            contactNumber: contactNumber || '',
            email: email || '',
            mapUrl: mapUrl || '',
        });

        res.status(201).json({ success: true, data: facility });
    } catch (error) {
        console.error('Create facility error:', error);
        res.status(500).json({ success: false, message: 'Failed to create facility' });
    }
};

// @desc    Update a facility
// @route   PUT /api/facilities/:id
// @access  Private/Admin
export const updateFacility = async (req, res) => {
    try {
        let facility = await Facility.findById(req.params.id);
        if (!facility) return res.status(404).json({ success: false, message: 'Facility not found' });

        facility = await Facility.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });

        res.status(200).json({ success: true, data: facility });
    } catch (error) {
        console.error('Update facility error:', error);
        res.status(500).json({ success: false, message: 'Failed to update facility' });
    }
};

// @desc    Delete a facility
// @route   DELETE /api/facilities/:id
// @access  Private/Admin
export const deleteFacility = async (req, res) => {
    try {
        const facility = await Facility.findById(req.params.id);
        if (!facility) return res.status(404).json({ success: false, message: 'Facility not found' });

        await facility.deleteOne();
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        console.error('Delete facility error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete facility' });
    }
};
