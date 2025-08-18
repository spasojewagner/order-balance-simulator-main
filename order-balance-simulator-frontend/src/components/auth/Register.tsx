import React, { useState, FC } from 'react';
import { useSnackbar } from 'notistack';
import { useAuthStore } from '../../store/useAuthStore';
import { RiLoader3Fill } from 'react-icons/ri';

interface RegisterProps {
  setRegister: (value: boolean) => void;
}

const Register: FC<RegisterProps> = ({ setRegister }) => {
  const { enqueueSnackbar } = useSnackbar();

  // State za formu
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    invitation: "",
    terms: false
  });

  // Handler za polja u formi
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const { register, isSigningUp } = useAuthStore();

  const validateForm = (): boolean => {
    if (!formData.fullName.trim()) {
      enqueueSnackbar("Full name is required", { variant: "error" });
      return false;
    }
    if (!formData.email.trim()) {
      enqueueSnackbar("Email is required", { variant: "error" });
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      enqueueSnackbar("Invalid email format", { variant: "error" });
      return false;
    }
    if (!formData.password) {
      enqueueSnackbar("Password is required", { variant: "error" });
      return false;
    }
    if (formData.password.length < 6) {
      enqueueSnackbar("Password must be at least 6 characters", { variant: "error" });
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      enqueueSnackbar("Passwords do not match", { variant: "error" });
      return false;
    }
    const trimmedName = formData.fullName.trim();
    if (trimmedName.length > 20) {
      enqueueSnackbar("Name must be at most 20 characters long", { variant: "error" });
      return false;
    }
    if (!trimmedName.includes(" ")) {
      enqueueSnackbar("Please enter both first name and last name", { variant: "error" });
      return false;
    }
    if (!formData.terms) {
      enqueueSnackbar("You must agree to the Terms of Service", { variant: "error" });
      return false;
    }
    return true;
  };

  // Handler za submit forme
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      const result = await register({
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        invitation: formData.invitation,
        terms: formData.terms
      });
      if (result.success) {
        enqueueSnackbar(result.message, { variant: "success" });
      } else {
        enqueueSnackbar(result.message, { variant: "error" });
      }
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Full Name Field */}
        <div className="relative">
          <input
            type="text"
            name='fullName'
            value={formData.fullName}
            onChange={handleChange}
            placeholder="John Doe"
            className="peer h-10 w-full border-b-2 border-gray-300 text-white bg-transparent placeholder-transparent focus:outline-none focus:border-green-500"
            required
            id="fullName"
          />
          <label
            htmlFor="fullName"
            className="absolute left-0 -top-3.5 text-gray-500 text-sm transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-placeholder-shown:top-2 peer-focus:-top-3.5 peer-focus:text-green-500 peer-focus:text-sm"
          >
            Full Name
          </label>
        </div>

        {/* Email Field */}
        <div className="relative">
          <input
            type="email"
            name='email'
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
            name='password'
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

        {/* Confirm Password Field */}
        <div className="relative">
          <input
            type="password"
            name='confirmPassword'
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="Confirm Password"
            className="peer h-10 w-full border-b-2 border-gray-300 text-white bg-transparent placeholder-transparent focus:outline-none focus:border-green-500"
            required
            id="confirmPassword"
          />
          <label
            htmlFor="confirmPassword"
            className="absolute left-0 -top-3.5 text-gray-500 text-sm transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-placeholder-shown:top-2 peer-focus:-top-3.5 peer-focus:text-green-500 peer-focus:text-sm"
          >
            Confirm Password
          </label>
        </div>

        {/* Invitation Code Field */}
        <div className="relative">
          <input
            type="text"
            name='invitation'
            value={formData.invitation}
            onChange={handleChange}
            placeholder="Invitation code"
            className="peer h-10 w-full border-b-2 border-gray-300 text-white bg-transparent placeholder-transparent focus:outline-none focus:border-green-500"
            id="invitation"
          />
          <label
            htmlFor="invitation"
            className="absolute left-0 -top-3.5 text-gray-500 text-sm transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-placeholder-shown:top-2 peer-focus:-top-3.5 peer-focus:text-green-500 peer-focus:text-sm"
          >
            Invitation code (optional)
          </label>
        </div>

        {/* Terms of Service */}
        <div className='flex items-center justify-between'>
          <label className="flex items-center text-sm text-gray-200">
            <input
              type="checkbox"
              name="terms"
              checked={formData.terms}
              onChange={handleChange}
              className="form-checkbox h-4 w-4 text-green-600 bg-gray-800 border-gray-300 rounded"
              required
            />
            <span className="ml-2">
              I agree to the <a href="#" className='text-green-400 hover:underline'>Terms of Service</a>
            </span>
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 rounded-md shadow-lg text-white font-semibold transition duration-200"
          disabled={isSigningUp}
        >
          {isSigningUp ? (
            <div className="flex items-center justify-center">
              <RiLoader3Fill className='animate-spin mr-2' /> REGISTERING...
            </div>
          ) : (
            "REGISTER"
          )}
        </button>
      </form>
    </div>
  );
};

export default Register;