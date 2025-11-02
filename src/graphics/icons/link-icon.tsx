import * as React from 'react';

export const LinkIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg
        width={16}
        height={16}
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
    >
        <path
            d="M6.25 4.5L4.5 6.25C3.12 7.63 3.12 9.88 4.5 11.25C5.88 12.63 8.13 12.63 9.5 11.25L10.5 10.25"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <path
            d="M9.75 11.5L11.5 9.75C12.88 8.37 12.88 6.12 11.5 4.75C10.12 3.37 7.87 3.37 6.5 4.75L5.5 5.75"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

export default LinkIcon;
