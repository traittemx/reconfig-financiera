import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

interface CircularProgressProps {
    size: number;
    strokeWidth: number;
    percentage: number;
    color: string;
    remainingText: string;
    amountText: string;
}

export const CircularProgress = ({
    size,
    strokeWidth,
    percentage,
    color,
    remainingText,
    amountText,
}: CircularProgressProps) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (Math.max(0, Math.min(100, percentage)) / 100) * circumference;

    return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={size} height={size}>
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="#f1f5f9"
                    strokeWidth={strokeWidth}
                    fill="none"
                />
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="none"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
                {percentage >= 0 && (
                    <Path
                        d={`M ${size / 2 - 5} ${size / 2 - 10} l 3.5 3.5 l 7 -7`}
                        fill="none"
                        stroke="#22c55e"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}
            </Svg>
            <View style={{ position: 'absolute', alignItems: 'center', top: size / 2 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#1e293b' }}>{amountText}</Text>
                <Text style={{ fontSize: 10, color: '#64748b' }}>{remainingText}</Text>
            </View>
        </View>
    );
};
