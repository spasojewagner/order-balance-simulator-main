import React, { useState, FC } from "react";
import { useAuthStore } from '../../store/useAuthStore';
import { useSnackbar } from "notistack";
import { useNavigate } from "react-router-dom";
import { RiLoader3Fill } from "react-icons/ri";

const Login: FC = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false
  });

  const { login, isLoggingIn } = useAuthStore();
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await login(formData);
    if (result.success) {
      enqueueSnackbar("Login successful", { variant: "success" });
      navigate("/home");
    } else {
      enqueueSnackbar(result.message, { variant: "error" });
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Email Field */}
        <div className="relative">
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="john@example.com"
            className="peer h-10 w-full border-b-2 border-gray-300 text-white bg-transparent placeholder-transparent focus:outline-none focus:border-green-500"
            required
            id="email"
          />
          <label
            htmlFor="email"
            className="absolute left-0 -top-3.5 text-gray-500 text-sm transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-placeholder-shown:top-2 peer-focus:-top-3.5 peer-focus:text-green-500 peer-focus:text-sm"
          >
            Email address
          </label>
        </div>

        {/* Password Field */}
        <div className="relative">
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Password"
            className="peer h-10 w-full border-b-2 border-gray-300 text-white bg-transparent placeholder-transparent focus:outline-none focus:border-green-500"
            required
            id="password"
          />
          <label
            htmlFor="password"
            className="absolute left-0 -top-3.5 text-gray-500 text-sm transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-placeholder-shown:top-2 peer-focus:-top-3.5 peer-focus:text-green-500 peer-focus:text-sm"
          >
            Password
          </label>
        </div>

        {/* Remember Me and Forgot Password */}
        <div className="flex items-center justify-between">
          <label className="flex items-center text-sm text-gray-200">
            <input
              type="checkbox"
              name="rememberMe"
              checked={formData.rememberMe}
              onChange={handleChange}
              className="form-checkbox h-4 w-4 text-green-600 bg-gray-800 border-gray-300 rounded"
            />
            <span className="ml-2">Remember me</span>
          </label>
          <a className="text-sm text-green-300 hover:underline" href="#">
            Forgot your password?
          </a>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 rounded-md shadow-lg text-white font-semibold transition duration-200"
          disabled={isLoggingIn}
        >
          {isLoggingIn ? (
            <div className="flex items-center justify-center">
              <RiLoader3Fill className="animate-spin mr-2" /> Signing in...
            </div>
          ) : (
            "Sign In"
          )}
        </button>
      </form>
    </div>
  );
};

export default Login;