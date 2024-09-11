// DON'T TOUCH THIS FILE

import React, { useContext } from "react";
import './ProductDisplay.css'
import star_icon from '../Assets/star_icon.png'
import star_dull_icon from '../Assets/star_dull_icon.png'
import { ShopContext } from "../../Context/ShopContext";

const ProductDisplay = (props) => {
        const{product} = props;
        const {addToCart} = useContext(ShopContext);

    return(
        <div className="productisplay">
            <div className="productisplay-left">
                <div className="productisplay-img-list">
                    <img src={product.image} alt="" />
                    <img src={product.image} alt="" />
                    <img src={product.image} alt="" />
                </div>
                <div className="productisplay-img">
                    <img src={product.image} alt="" className="productisplay-main-img" />
                </div>
            </div>
            <div className="productisplay-right">
                <h1>{product.name}</h1>
                <div className="productisplay-right-star">
                    <img src={star_icon} alt="" />
                    <img src={star_icon} alt="" />
                    <img src={star_icon} alt="" />
                    <img src={star_icon} alt="" />
                    <img src={star_dull_icon} alt="" />
                    <p>122</p>
                </div>
                <div className="productisplay-right-prices">
                    <div className="productisplay-right-prices-old">
                        {product.old_price}
                    </div>
                    <div className="productisplay-right-prices-new">
                        {product.new_price}
                    </div>
                </div>
                <div className="productisplay-right-description">
                    Lorem ipsum, dolor sit amet consectetur adipisicing elit. Error iure ipsam sit fugiat necessitatibus doloremque ducimus quo quos perferendis officiis voluptates quis nostrum, amet repellendus. Incidunt deserunt laudantium repellat pariatur!
                </div>
                <div className="productisplay-right-size">
                    <h1>select size</h1>
                    <div className="productisplay-right-sizes">
                        <div>S</div>
                        <div>M</div>
                        <div>L</div>
                        <div>X</div>
                        <div>XXL</div>
                    </div>
                </div>
                <button onClick={() => {addToCart(product.id)}}>
                    ADD TO CART
                </button>
                <p className="productisplay-right-category"><span> category :</span>women ,t-shirt, crop-top</p>
                <p className="productisplay-right-category"><span> tags :</span> modern, latest</p>

            </div>
        </div>
    )
}

export default ProductDisplay