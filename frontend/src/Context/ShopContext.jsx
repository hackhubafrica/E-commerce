import React, { createContext, useEffect, useMemo, useState } from "react";
import all_product from "../Components/Assets/all_product";
import { API_URL } from "../config";
// import Item from "../Components/Item/Item";

export const ShopContext = createContext(null);

const getDefaultCart = () => Object.fromEntries(
	all_product.map(({ id }) => [id, 0])
);


const ShopContextProvider = (props) => {
	const [cartItems, setCartItems] = useState(getDefaultCart());
	const [managedProducts, setManagedProducts] = useState([]);
	const [catalogError, setCatalogError] = useState("");

	useEffect(() => {
		if (!API_URL) return;
		let active = true;
		fetch(`${API_URL}/allproducts`)
			.then((response) => {
				if (!response.ok) throw new Error("Unable to load current products.");
				return response.json();
			})
			.then((products) => {
				if (active) {
					setManagedProducts(Array.isArray(products) ? products : []);
					setCatalogError("");
				}
			})
			.catch(() => {
				if (active) setCatalogError("Some products may be missing while the product service is unavailable.");
			});
		return () => { active = false; };
	}, []);

	const products = useMemo(() => {
		const managedIds = new Set(managedProducts.map((product) => String(product.id)));
		return [
			...managedProducts,
			...all_product.filter((product) => !managedIds.has(String(product.id))),
		];
	}, [managedProducts]);

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
				const itemInfo = products.find((product) => String(product.id) === String(itemId));
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
	const contextValue = {
		getTotalCartItems,
		getTotalCartAmount,
		all_product: products,
		managedProducts,
		cartItems,
		addToCart,
		removeFromCart,
		catalogError,
	};

	return (
		<ShopContext.Provider value={contextValue}>
			{props.children}
		</ShopContext.Provider>
	)
}

export default ShopContextProvider;