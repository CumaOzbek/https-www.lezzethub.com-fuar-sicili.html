import { Redirect } from 'expo-router';

// "İlan Ver" sekmesi basıldığında ilan formu açılır; bu ekran doğrudan gösterilmez.
export default function Sell() {
  return <Redirect href="/listing-form" />;
}
