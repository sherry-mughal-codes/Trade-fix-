"use client";

import { Toaster } from "react-hot-toast";

export const ToastProvider = () => {
  return (
    <Toaster 
        position="top-right"
        toastOptions={{
            duration: 4000,
            style: {
                background: '#363636',
                color: '#fff',
            },
            success: {
                style: {
                    background: '#34c38f',
                },
                iconTheme: {
                    primary: '#fff',
                    secondary: '#34c38f',
                },
            },
            error: {
                style: {
                    background: '#f46a6a',
                },
                iconTheme: {
                    primary: '#fff',
                    secondary: '#f46a6a',
                },
            },
        }}
    />
  );
};
