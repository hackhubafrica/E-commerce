import React from 'react'
import "./CSS/LoginSignup.css"

const LoginSignup =() => {
return (

	<div className='loginsignup'>
		<div className="loginsignup-container">
			<h1>Sign Up</h1>
			<div className="loginsignup-fields">
				<input type="text" placeholder='Your Name' />
				<input type="text" placeholder='Email Address' />
				<input type="text" placeholder='Password' />
			</div>
			<button>Continue</button>	
			<p className="loginsignup-login">Already have an account? <span>Login</span></p>
			<div className="loginsignuo-agree">
				<input type="checkbox" name='' id='' />
				<p>By Continuing , i agree to the terms of use ...</p>
			</div>

		</div>
		
	</div>	
)
}

export default LoginSignup