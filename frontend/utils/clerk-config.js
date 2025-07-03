export const clerkConfig = {
  publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  appearance: {
    baseTheme: undefined,
    variables: {
      colorPrimary: '#2563eb',
      colorBackground: '#ffffff',
      colorInputBackground: '#ffffff',
      colorInputText: '#1f2937',
    },
    elements: {
      formButtonPrimary: 'bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-md transition-colors',
      card: 'shadow-lg border border-gray-200 rounded-lg',
      headerTitle: 'text-gray-900 font-semibold',
      headerSubtitle: 'text-gray-600',
      socialButtonsIconButton: 'border border-gray-300 hover:border-gray-400',
      dividerLine: 'bg-gray-200',
      formFieldLabel: 'text-gray-700 font-medium',
      formFieldInput: 'border border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500',
      footerActionLink: 'text-blue-600 hover:text-blue-500',
    },
  },
};