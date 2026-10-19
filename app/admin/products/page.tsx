import ProductsManager from './ProductsManager';

export const metadata = { title: 'Products & stock' };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ filter?: string; focus?: string }> }) {
  const { filter, focus } = await searchParams;
  return <ProductsManager initialFilter={filter || 'all'} focusId={focus || null} />;
}
