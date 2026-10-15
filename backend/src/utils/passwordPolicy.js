const PASSWORD_POLICY_MESSAGE = 'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.';
const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,}$/;

const validatePassword = (password) => {
    if (typeof password !== 'string' || !PASSWORD_POLICY.test(password)) {
        throw new TypeError(PASSWORD_POLICY_MESSAGE);
    }
    return password;
};

module.exports = { PASSWORD_POLICY_MESSAGE, validatePassword };
