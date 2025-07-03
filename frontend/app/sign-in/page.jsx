import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Access your personal media server dashboard
          </p>
        </div>
        <div className="flex justify-center">
          <SignIn 
            path="/sign-in" 
            routing="path" 
            signUpUrl="/sign-up"
            redirectUrl="/dashboard"
            appearance={{
              elements: {
                rootBox: "mx-auto",
                card: "shadow-lg border border-gray-200 rounded-lg",
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}