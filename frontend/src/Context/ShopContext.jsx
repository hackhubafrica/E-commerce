import React, { createContext, useState } from "react"; 
import all_product from "../Components/Assets/all_product";
// import Item from "../Components/Item/Item";

export const ShopContext = createContext(null);

const getDefaultCart = () => Object.fromEntries(
	all_product.map(({ id }) => [id, 0])
);


const ShopContextProvider = (props) => {
	const [cartItems, setCartItems] = useState(getDefaultCart());

	const addToCart = (itemId) => {
		setCartItems((prev) => ({ ...prev, [itemId]: (prev[itemId] ?? 0) + 1 }))
	}
	
	const removeFromCart = (itemId) => {
		setCartItems((prev) => ({
			...prev,
			[itemId]: Math.max((prev[itemId] ?? 0) - 1, 0),
		}))
	}

	const getTotalCartAmount = () => {
		let totalAmount = 0;
		for (const [itemId, quantity] of Object.entries(cartItems)) {
			if (quantity > 0) {
				const itemInfo = all_product.find((product) => product.id === Number(itemId));
				if (itemInfo) {
					totalAmount += itemInfo.new_price * quantity;
				}
			}
		}
		return totalAmount;
	}


	const  getTotalCartItems = () => {
		let totalItem = 0;
		for (const item in cartItems)
		{
			if (cartItems[item] >0 )
				{
					totalItem += cartItems[item];
				}
		}
		return totalItem;
	} 
	const contextValue = { getTotalCartItems, getTotalCartAmount ,all_product, cartItems, addToCart ,removeFromCart};

	return (
		<ShopContext.Provider value={contextValue}>
			{props.children}
		</ShopContext.Provider>
	)
}

export default ShopContextProvider;