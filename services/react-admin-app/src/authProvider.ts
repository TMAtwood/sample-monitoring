import type { AuthProvider } from "react-admin";

const VALID_EMAIL = "thomas.atwood@geodecapital.com";
const VALID_PASSWORD = "demo12345";
const AUTH_KEY = "geode_auth";

export const authProvider: AuthProvider = {
  login: ({ username, password }) => {
    if (username === VALID_EMAIL && password === VALID_PASSWORD) {
      localStorage.setItem(AUTH_KEY, JSON.stringify({ email: username }));
      return Promise.resolve();
    }
    return Promise.reject(new Error("Invalid email or password"));
  },

  logout: () => {
    localStorage.removeItem(AUTH_KEY);
    return Promise.resolve();
  },

  checkAuth: () => {
    return localStorage.getItem(AUTH_KEY)
      ? Promise.resolve()
      : Promise.reject();
  },

  checkError: (error) => {
    const status = error?.status ?? error?.response?.status;
    if (status === 401 || status === 403) {
      localStorage.removeItem(AUTH_KEY);
      return Promise.reject();
    }
    return Promise.resolve();
  },

  getIdentity: () =>
    Promise.resolve({
      id: 1,
      fullName: "Thomas Atwood",
    }),

  getPermissions: () => Promise.resolve("admin"),
};
