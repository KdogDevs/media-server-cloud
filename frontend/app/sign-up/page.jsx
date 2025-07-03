import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Start your 7-day free trial and get your own media server
          </p>
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  What you get:
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <ul className="list-disc list-inside space-y-1">
                    <li>7-day free trial</li>
                    <li>Your own Jellyfin/Plex/Emby server</li>
                    <li>2TB cloud storage included</li>
                    <li>Custom subdomain (your-name.domain.com)</li>
                    <li>Automatic SSL & backups</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-center">
          <SignUp 
            path="/sign-up" 
            routing="path" 
            signInUrl="/sign-in"
            redirectUrl="/dashboard?welcome=true"
            appearance={{
              elements: {
                rootBox: "mx-auto",
                card: "shadow-lg border border-gray-200 rounded-lg",
              }
            }}
          />
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500">
            By signing up, you agree to our{' '}
            <a href="/terms" className="text-blue-600 hover:text-blue-500">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" className="text-blue-600 hover:text-blue-500">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}