import React, {useContext} from 'react'
import { ShopContext } from '../Context/ShopContext'
import { useParams, useSearchParams } from 'react-router-dom'
import Breadcrum from '../Components/Breadcrums/Breadcrum'
import ProductDisplay from '../Components/ProductDisplay/ProductDisplay'
import DescriptionBox from '../Components/DescriptionBox/DescriptionBox'
import RelatedProducts from '../Components/RelatedProducts/RelatedProducts'
const Product = () => {
    const { all_product } = useContext(ShopContext);
	const {productId} = useParams();
	const [searchParams] = useSearchParams();
	const selectedId = productId || searchParams.get('id');
	const product = all_product.find((item) => String(item.id) === String(selectedId));

	if (!product) {
		return <p className="product-not-found">Product not found.</p>;
	}

	return (
		<div>
			<Breadcrum product = {product}/>
			<ProductDisplay product = {product}/>
			<DescriptionBox/>
			<RelatedProducts productId={product.id} />
			
		</div>
	)


}

export default Product