import React, { useContext } from 'react'
import './CSS/ShopCategory.css'
import { ShopContext } from '../Context/ShopContext'
import dropdown_icon from '../Components/Assets/dropdown_icon.png'
import Item from '../Components/Item/Item'
import getImageSrc from '../utils/getImageSrc'

const ShopCategory = (props) => {
    const { all_product, catalogError } = useContext(ShopContext);
    const products = all_product.filter((item) => props.category === item.category);

    return (
        <div className="shop-category">
            <img className="shopcategory-banner" src={getImageSrc(props.banner)} alt={`${props.category} clothing collection`} />
            <div className="shopcategory-IndexSort">
                <p>
                    <span>Showing {products.length} products</span>
                </p>
                <div className="shopcategory-sort">
                    sort by <img src={getImageSrc(dropdown_icon)} alt="" />
                </div>
            </div>
            <div className="shopcategory-products">
            {catalogError && <p role="status">{catalogError}</p>}
            {products.map((item) => (
                                <Item
                                    key={item.id}
                                    id={item.id}
                                    name={item.name}
                                    image={item.image}
                                    new_price={item.new_price}
                                    old_price={item.old_price}
                                />
                    ))}
            </div>
        </div>
    )
}

export default ShopCategory;
