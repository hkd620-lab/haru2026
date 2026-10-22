export { useAuth } from '../reading-ai-browser/providers';
export const useSubscription = () => ({subscription:{status:'active', plan: new URLSearchParams(location.search).get('plan') || 'basic'}});
export const useLoading = () => ({showLoading(){},showLoadingWithProgress(){},updateProgress(){},hideLoading(){}});
