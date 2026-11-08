import React, { useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import './CartItems.css'
import { ShopContext } from '../../Context/ShopContext'
import remove_icon from '../Assets/cart_cross_icon.png'
import getImageSrc from '../../utils/getImageSrc'


const CartItems =() => {
	const {getTotalCartAmount ,all_product, cartItems,removeFromCart, } = useContext(ShopContext);
    const navigate = useNavigate();
    const productsInCart = all_product.filter((product) => cartItems[product.id] > 0);
    
return (
	<div className="cartitems">
        <div className="cartitems-format-main cartitems-heading" aria-hidden="true">
            <p> Product</p>
            <p> Title</p>
            <p> Price</p>
            <p> Quantity</p>
            <p> Total</p>
            <p> Remove</p>
        </div>
        <div className="cartitems-list">
            {productsInCart.length ? productsInCart.map((product) => (
                <div className="cartitems-format cartitems-format-main" key={product.id}>
                    <img src={getImageSrc(product.image)} alt={product.name} className="carticon-product-icon" />
                    <p className="cartitems-product-name">{product.name}</p>
                    <p>${product.new_price.toFixed(2)}</p>
                    <span className="cartitems-quantity" aria-label={`Quantity: ${cartItems[product.id]}`}>
                        {cartItems[product.id]}
                    </span>
                    <p>${(product.new_price * cartItems[product.id]).toFixed(2)}</p>
                    <button
                        type="button"
                        className="cartitems-remove"
                        onClick={() => removeFromCart(product.id)}
                        aria-label={`Remove ${product.name} from cart`}
                    >
                        <img className="carticon-remove-icon" src={getImageSrc(remove_icon)} alt="" />
                    </button>
                </div>
            )) : <p className="cartitems-empty">Your cart is empty. Add something you love to get started.</p>}
        </div>
        <div className="cartitems-down">
            <div className="cartitems-total">
                <h1>Cart Totals</h1>
                <div>
                    <div className="cartitems-total-item">
                        <p>Subtotal</p>
                        <p>${getTotalCartAmount()}</p>
                    </div>
                </div>
                <hr />
                <div className="cartitems-total-item">
                    <p>Shipping fee</p>
                    <p>Calculated at checkout</p>
                </div>
                <hr />
                <div className="cartitems-total-item">
                    <h3>Total</h3>
                    <h3>${getTotalCartAmount()}</h3>
                </div>
            <button
                type="button"
                onClick={() => navigate('/checkout')}
                disabled={!productsInCart.length}
            >
                PROCEED TO CHECKOUT
            </button>
            </div>

        </div>
        

	</div>
		
    )
}

export default CartItems