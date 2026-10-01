/**
 * @typedef {Object} LoginRequest
 * @property {string} email
 * @property {string} password
 */

/**
 * @typedef {Object} RegisterRequest
 * @property {string} fullName
 * @property {string} email
 * @property {string} password
 * @property {string} phone
 */

export const authTypes = {
  login: {
    email: '',
    password: '',
  },
  register: {
    fullName: '',
    email: '',
    password: '',
    phone: '',
  },
};
