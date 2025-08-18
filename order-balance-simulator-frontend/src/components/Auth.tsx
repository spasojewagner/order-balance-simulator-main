/* src/pages/Auth.tsx */
import  { useState, FC, useEffect } from 'react';
import Register from '../components/auth/Register';
import Login from '../components/auth/Login';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import img1 from '../assets/images/pozadina1.png'

const Auth: FC = () => {
  const [isRegister, setRegister] = useState(false);
  const { authUser, } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (authUser) {
      navigate('/');
    }
  }, [authUser, navigate]);

  return (
    <div className='flex min-h-screen mb:flex-col'>
      {/* Left side - Image section */}
      <div className='w-1/2 relative hidden md:flex items-center justify-center bg-cover'>
        <img className='w-full h-full object-cover' src={img1} alt='pozadina' /> 
        <div className='absolute inset-0 bg-opacity-80'>
          <blockquote className='absolute bottom-5 px-5 text-2xl italic text-white bg-[#3938389b] py-2 rounded-2xl'>
            Bitcoin is more than money – it's a movement against the centralization of power.
            <br />
            <span className='block mt-4 text-yellow-400'>- Founder of Raven</span>
          </blockquote>
        </div>
      </div>

      {/* Right side - Auth form section */}
      <div className='w-full md:w-1/2 min-h-screen bg-gradient-to-tr from-[#0f0c29] via-[#302b63] to-[#24243e] flex items-center justify-center p-10'>
        <div 
          className='max-w-md w-full bg-gradient-to-r from-[#0f0c29] via-[#302b63] to-[#24243e] rounded-xl shadow-2xl overflow-hidden p-8 space-y-8'
          style={{ animation: 'slideInFromLeft 1s ease-out' }}
        >
          {/* Header */}
          <div className='flex flex-col items-center space-y-4'>
            <h2 
              className='text-center text-4xl font-extrabold text-white'
              style={{ animation: 'appear 2s ease-out' }}
            >
              Welcome
            </h2>
            <p 
              className='text-center text-gray-200'
              style={{ animation: 'appear 3s ease-out' }}
            >
              {isRegister ? 'Create your account' : 'Sign in to your account'}
            </p>
          </div>

          {/* Form Container */}
          <div className='space-y-6'>
            {isRegister ? <Register setRegister={setRegister} /> : <Login />}
          </div>

          {/* Toggle between Login/Register */}
          <div className='text-center text-gray-300'>
            <span className='text-sm'>
              {isRegister ? 'Already have an account?' : "Don't have an account?"}
            </span>
            <button
              onClick={() => setRegister(!isRegister)}
              className='ml-2 text-green-400 hover:underline font-semibold transition duration-200'
            >
              {isRegister ? 'Sign in' : 'Sign up'}
            </button>
          </div>
        </div>
      </div>

     
    </div>
  );
};

export default Auth;