import Facility from '../models/Facility.js';

// @desc    Get facilities for an institute (with stats)
// @route   GET /api/facilities
// @access  Private
export const getFacilities = async (req, res) => {
    try {
        const instituteId = req.user.instituteId || req.query.instituteId;
        const query = instituteId ? { instituteId } : {};

        const facilities = await Facility.find(query).sort({ createdAt: -1 });

        // Dynamic stats
        const total = facilities.length;
        const active = facilities.filter(f => f.status === 'active').length;
        const inactive = facilities.filter(f => f.status === 'inactive').length;
        const pending = facilities.filter(f => f.status === 'pending').length;

        // Recent activity (last 10 additions)
        const recentActivities = facilities.slice(0, 5).map(f => ({
            id: f._id,
            action: `${f.campusName} branch was added`,
            time: f.createdAt,
        }));

        // Category breakdown
        const categoryMap = {};
        for (const f of facilities) {
            for (const cat of (f.categories || [])) {
                categoryMap[cat] = (categoryMap[cat] || 0) + 1;
            }
        }

        res.status(200).json({
            success: true,
            count: total,
            data: facilities,
            facilities,
            stats: { total, active, inactive, pending },
            recentActivities,
            categoryBreakdown: Object.entries(categoryMap).map(([name, count]) => ({ name, count })),
        });
    } catch (error) {
        console.error('Get facilities error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch facilities' });
    }
};

// @desc    Create a facility (branch)
// @route   POST /api/facilities
// @access  Private/Admin
export const createFacility = async (req, res) => {
    try {
        const {
            campusName, branchCode, address,
            contactPerson, contactEmail, contactPhone, alternatePhone, website, notes,
            categories, features, infrastructure, images, mapUrl, status,
        } = req.body;

        if (!campusName) {
            return res.status(400).json({ success: false, message: 'Branch name is required' });
        }

        const facility = await Facility.create({
            instituteId: req.user.instituteId || req.body.instituteId,
            campusName,
            branchCode: branchCode || '',
            address: address || {},
            contactPerson: contactPerson || '',
            contactEmail: contactEmail || '',
            contactPhone: contactPhone || '',
            alternatePhone: alternatePhone || '',
            website: website || '',
            notes: notes || '',
            categories: categories || [],
            features: features || [],
            infrastructure: infrastructure || [],
            images: images || [],
            mapUrl: mapUrl || '',
            status: status || 'active',
        });

        res.status(201).json({ success: true, message: 'Branch created successfully', data: facility, facility });
    } catch (error) {
        console.error('Create facility error:', error);
        res.status(500).json({ success: false, message: 'Failed to create branch' });
    }
};

// @desc    Update a facility (branch)
// @route   PUT /api/facilities/:id
// @access  Private/Admin
export const updateFacility = async (req, res) => {
    try {
        let facility = await Facility.findById(req.params.id);
        if (!facility) return res.status(404).json({ success: false, message: 'Branch not found' });

        facility = await Facility.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });

        res.status(200).json({ success: true, message: 'Branch updated successfully', data: facility, facility });
    } catch (error) {
        console.error('Update facility error:', error);
        res.status(500).json({ success: false, message: 'Failed to update branch' });
    }
};

// @desc    Delete a facility (branch)
// @route   DELETE /api/facilities/:id
// @access  Private/Admin
export const deleteFacility = async (req, res) => {
    try {
        const facility = await Facility.findById(req.params.id);
        if (!facility) return res.status(404).json({ success: false, message: 'Branch not found' });

        await facility.deleteOne();
        res.status(200).json({ success: true, message: 'Branch deleted successfully', data: {} });
    } catch (error) {
        console.error('Delete facility error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete branch' });
    }
};
