// Tab "Kết nối" — re-export Care Circle screen từ /app/care-circle/index.
// Lý do file riêng: expo-router yêu cầu Tabs.Screen name match file path
// trong (tabs) folder. Re-export để avoid duplicate code.
export { default } from '../../care-circle/index';
