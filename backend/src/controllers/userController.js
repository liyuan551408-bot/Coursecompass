const userService = require('../services/userService');

const getMe = async (req, res) => {
    try {
        const userId = req.user.id;

        const user = await userService.findPublicUserById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.status(200).json({ success: true, data: user });
    } catch (error) {
        console.error('Get Profile Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, major, studyYear, interests, goals, planningPreferences } = req.body;

        const updatedUser = await userService.updateUserProfile(userId, { name, major, studyYear, interests, goals, planningPreferences });

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: updatedUser
        });
    } catch (error) {
        if (error.statusCode === 403) {
            return res.status(403).json({ success: false, message: error.message });
        }
        if (error instanceof TypeError) {
            return res.status(400).json({ success: false, message: error.message });
        }
        console.error('Update Profile Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

module.exports = {
    getMe,
    updateProfile
};
