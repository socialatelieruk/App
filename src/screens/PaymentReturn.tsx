// Where Stripe Checkout sends brands back to (?payment=success or cancelled).
export default function PaymentReturn({ status }: { status: string }) {
  const success = status === 'success'
  return (
    <div className="auth">
      <img className="logo" src={`${import.meta.env.BASE_URL}logo.png`} alt="The Social Atelier" />
      <h1 className="pending-title">{success ? 'Thank you, payment received' : 'Payment not completed'}</h1>
      <p className="lead">
        {success
          ? 'Your package will show in the app within a minute. Close this window, or continue here, to submit your brief.'
          : 'No payment was taken. You can choose a package again whenever you’re ready.'}
      </p>
      <a className="primary" href={window.location.pathname}>
        Continue
      </a>
    </div>
  )
}
