import React from 'react'
import Hero from '../Components/Hero/Hero'
import Popular from '../Components/Popular/Popular'
import Offers from '../Components/Offers/Offers'
import NewCollections from '../Components/NewCollections/NewCollections'
import NewLetter from '../Components/NewsLetter/NewsLetter'
import { useContext } from 'react'
import { ShopContext } from '../Context/ShopContext'
const Shop =() => {
const { catalogError } = useContext(ShopContext);
return (

	<div>
		{catalogError && <p className="catalog-status" role="status">{catalogError}</p>}
		<Hero/>
		<Popular/>
		<Offers/>
		<NewCollections/>
		<NewLetter/>

	</div>	
	)
}

export default Shop