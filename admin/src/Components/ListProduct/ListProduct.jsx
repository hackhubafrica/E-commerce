import React, { useEffect, useState } from 'react'
import './ListProduct.css'
import cross_icon from '../../assets/cross_icon.png'


const ListProduct = (products, setProducts) => {

    const [allproducts,setAllProducts] = useState ([]);

    const fetchInfo = async (id) => {
        await fetch ('http://localhost:4000/allproducts')
        .then((res) => res.json())
        .then((data)=>{setAllProducts(data)});
    }

    useEffect(() =>{
        fetchInfo();
    },[])



    const remove_product = async (id) => {
    try {
        const response = await fetch('http://localhost:4000/removeproduct', {
            method: 'POST',
            headers: {
                // Accept: 'application/json',
                'Content-Type': 'application/json' // Ensure this line is included if you send JSON
            },
            body: JSON.stringify({ id }), // Pass the id in the body
        });

            if (response.ok) {
        const data = await response.json();
        console.log(data.message);

        // Update the frontend by removing the deleted product from the list
        setProducts((prevProducts) => prevProducts.filter((product) => product._id !== id));
        // if (data.success) {
            // alert("Product removed successfully");
            // Optionally, refresh the list of products or update the state
        } else {
            console.error('Failed to remove product:', response.statusText);
        }
    } catch (error) {
        console.error("Error removing product:", error);
        alert("An error occurred while removing the product");
    }
    if (responseData.success) {
        setProducts((prevProducts) => prevProducts.filter((p) => p.id !== id)); // Remove product from state
    }
};


return (
    <div className="list-product">
        <h1>All Products List</h1>
        <div className="listproduct-format-main">
            <p>Product</p>
            <p>Title</p>
            <p>Old Price</p>
            <p>New Price</p>
            <p>Category</p>
            <p>Remove</p>
        </div>
        <div className="listproduct-allproducts">
            <hr />
            {allproducts.map((product,index) =>{
                return <div key={index} className="listproduct-format-main listproduct-format">
                    <img src={product.image} alt="" className='listproduct-product-icon'/>
                    <p>{product.name}</p>
                    <p>${product.old_price}</p>
                    <p>${product.new_price}</p>
                    <p>{product.category}</p>
                    <img onClick={() => remove_product(product.id)} src={cross_icon} alt="" className='listproduct-remove-icon' />
                </div>

            })}
        </div>
    </div>

    )
}

export default ListProduct